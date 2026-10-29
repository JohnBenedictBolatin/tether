"""Convert selected BodyParts3D OBJ meshes into an offline GLB without Blender."""
from __future__ import annotations

import json
import re
import struct
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "bodyparts3d-99.zip"
OUT = ROOT / "public" / "assets" / "anatomy"

PATTERNS = {
    "surface": [r"^skin$"],
    "digestive": [r"stomach", r"liver", r"pancreas", r"intestin", r"gallbladder", r"esophagus", r"digestive", r"colon", r"rectum"],
    "cardiovascular": [r"aorta", r"vena cava", r"coronary", r"pulmonary (artery|trunk)", r"common carotid", r"internal jugular", r"subclavian artery", r"renal artery", r"iliac artery", r"femoral artery", r"brachial artery", r"heart", r"atrium", r"ventricle"],
    "respiratory": [r"lung", r"respiratory", r"trache", r"bronch", r"larynx", r"pharynx"],
    "muscular": [r"muscle", r"muscular", r"fibularis", r"tibialis", r"extensor", r"flexor", r"levator", r"pronator", r"supinator", r"adductor", r"abductor", r"biceps", r"triceps", r"deltoid", r"gluteal", r"obturator", r"gastrocnemius", r"soleus", r"pectoral", r"sartorius", r"iliotibial", r"psoas", r"scalene", r"rhomboid", r"latissimus", r"vastus", r"gracilis", r"serratus", r"intercostal"],
    "skeleton": [r"\bbone\b", r"skeletal", r"skeleton", r"vertebr", r"\brib\b", r"\bsternum\b", r"\bskull\b", r"\bfemur\b", r"\bpatella\b", r"\btibia\b", r"\bfibula\b", r"\bclavicle\b", r"\bscapula\b", r"\bhumerus\b", r"\bulna\b", r"\bradius\b", r"\bcarpal\b", r"\bmetacarpal\b", r"\bphalange\w*\b", r"\btarsal bone\b", r"\bmetatarsal\b", r"\bsacrum\b", r"\bcoccyx\b", r"\bpelvis\b", r"\bilium\b", r"\bischium\b", r"\bpubis\b", r"\bmandible\b", r"\bmaxilla\b"],
}


def read_header(stream: object) -> dict[str, str]:
    fields: dict[str, str] = {}
    for raw in stream:
        line = raw.decode("utf-8", "replace")
        if not line.startswith("#"):
            break
        match = re.match(r"#\s*([^:]+?)\s*:\s*(.*)", line.strip())
        if match:
            fields[match.group(1).strip().lower()] = match.group(2).strip()
    return fields


def classify(name: str) -> str | None:
    value = name.casefold()
    for system, patterns in PATTERNS.items():
        if any(re.search(pattern, value) for pattern in patterns):
            return system
    return None


def display_name(system: str, name: str) -> str:
    if system == "skeleton": return "skeleton|Skeleton"
    if system == "muscular": return "muscles|Muscles"
    if system == "surface": return "skin|Skin"
    if system == "cardiovascular": return "vessels|Great vessels"
    return f"{system}|{name}"


def read_obj(stream: object) -> tuple[list[tuple[float, float, float]], list[int]]:
    positions: list[tuple[float, float, float]] = []
    indices: list[int] = []
    for raw in stream:
        if raw.startswith(b"v "):
            parts = raw.split()
            if len(parts) >= 4:
                positions.append((float(parts[1]), float(parts[2]), float(parts[3])))
        elif raw.startswith(b"f "):
            face = [int(part.split(b"/", 1)[0]) for part in raw.split()[1:]]
            face = [index - 1 if index > 0 else len(positions) + index for index in face]
            for i in range(1, len(face) - 1):
                indices.extend((face[0], face[i], face[i + 1]))
    return positions, indices


def align(data: bytearray) -> None:
    while len(data) % 4:
        data.append(0)


def main() -> None:
    if not ARCHIVE.exists():
        raise SystemExit(f"Source archive not found: {ARCHIVE}")
    OUT.mkdir(parents=True, exist_ok=True)
    binary = bytearray()
    views: list[dict[str, int]] = []
    accessors: list[dict[str, object]] = []
    meshes: list[dict[str, object]] = []
    nodes: list[dict[str, object]] = []
    manifest: list[dict[str, object]] = []
    seen: set[tuple[str, str]] = set()
    groups: dict[str, dict[str, object]] = {}
    with zipfile.ZipFile(ARCHIVE) as archive:
        entries = [name for name in archive.namelist() if name.lower().endswith(".obj")]
        for index, path in enumerate(entries, 1):
            with archive.open(path) as stream:
                header = read_header(stream)
            name = header.get("english name", Path(path).stem)
            system = classify(name)
            if not system:
                continue
            # The dataset may include the same concept more than once in a hierarchy.
            concept = header.get("concept id", Path(path).stem)
            if (system, concept) in seen:
                continue
            with archive.open(path) as stream:
                positions, indices = read_obj(stream)
            if not positions or len(indices) < 3:
                continue
            seen.add((system, concept))
            node_name = display_name(system, name)
            group = groups.setdefault(node_name, {"positions": bytearray(), "indices": bytearray(), "vertexCount": 0, "min": [float("inf")] * 3, "max": [float("-inf")] * 3})
            vertex_base = int(group["vertexCount"])
            for vertex in positions:
                group["positions"].extend(struct.pack("<3f", *vertex))
            for value in indices:
                group["indices"].extend(struct.pack("<I", value + vertex_base))
            group["vertexCount"] = vertex_base + len(positions)
            for axis in range(3):
                group["min"][axis] = min(group["min"][axis], min(v[axis] for v in positions))
                group["max"][axis] = max(group["max"][axis], max(v[axis] for v in positions))
            manifest.append({"id": concept, "label": name, "meshName": node_name, "system": system, "sourceFile": Path(path).name, "representationId": header.get("representation id", ""), "sourceConceptId": concept})
            if index % 250 == 0:
                print(f"scanned {index}/{len(entries)} source meshes; retained {len(meshes)}")

    for node_name, group in groups.items():
        pos_offset = len(binary)
        binary.extend(group["positions"])
        align(binary)
        views.append({"buffer": 0, "byteOffset": pos_offset, "byteLength": len(group["positions"]), "target": 34962})
        accessors.append({"bufferView": len(views) - 1, "componentType": 5126, "count": group["vertexCount"], "type": "VEC3", "min": group["min"], "max": group["max"]})
        position_accessor = len(accessors) - 1
        idx_offset = len(binary)
        binary.extend(group["indices"])
        align(binary)
        views.append({"buffer": 0, "byteOffset": idx_offset, "byteLength": len(group["indices"]), "target": 34963})
        accessors.append({"bufferView": len(views) - 1, "componentType": 5125, "count": len(group["indices"]) // 4, "type": "SCALAR", "min": [0], "max": [group["vertexCount"] - 1]})
        index_accessor = len(accessors) - 1
        mesh_index = len(meshes)
        meshes.append({"name": node_name, "primitives": [{"attributes": {"POSITION": position_accessor}, "indices": index_accessor, "material": 0, "mode": 4}]})
        nodes.append({"name": node_name, "mesh": mesh_index})

    document = {
        "asset": {"version": "2.0", "generator": "Tether BodyParts3D preparation tool"},
        "scene": 0,
        "scenes": [{"nodes": list(range(len(nodes)))}],
        "nodes": nodes,
        "meshes": meshes,
        "materials": [{"name": "Tether anatomical surface", "pbrMetallicRoughness": {"baseColorFactor": [0.8, 0.85, 0.87, 1], "metallicFactor": 0.05, "roughnessFactor": 0.68}, "doubleSided": True}],
        "buffers": [{"byteLength": len(binary)}],
        "bufferViews": views,
        "accessors": accessors,
    }
    json_chunk = json.dumps(document, separators=(",", ":")).encode("utf-8")
    json_chunk += b" " * ((4 - len(json_chunk) % 4) % 4)
    total = 12 + 8 + len(json_chunk) + 8 + len(binary)
    glb = bytearray(struct.pack("<4sII", b"glTF", 2, total))
    glb.extend(struct.pack("<I4s", len(json_chunk), b"JSON"))
    glb.extend(json_chunk)
    glb.extend(struct.pack("<I4s", len(binary), b"BIN\x00"))
    glb.extend(binary)
    (OUT / "reference-body.glb").write_bytes(glb)
    (OUT / "structure-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    totals: dict[str, int] = {}
    for item in manifest:
        totals[item["system"]] = totals.get(item["system"], 0) + 1
    print(f"wrote {len(glb) / 1_000_000:.1f} MB GLB with {len(nodes)} merged anatomical groups")
    print(json.dumps(totals, indent=2))


if __name__ == "__main__":
    main()
