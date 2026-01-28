#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEFAULT_OUT_DIR="${ROOT_DIR}/docs/extension"
OUT_DIR="${DEFAULT_OUT_DIR}"
NO_ZIP=0
NO_UPDATE_MANIFEST=0
NEXT_IS_OUT=0

for arg in "$@"; do
  case "${arg}" in
    --out|--out-dir)
      NEXT_IS_OUT=1
      ;;
    --out=*|--out-dir=*)
      OUT_DIR="${arg#*=}"
      ;;
    --no-zip)
      NO_ZIP=1
      ;;
    --no-update-manifest)
      NO_UPDATE_MANIFEST=1
      ;;
    *)
      if [[ "${NEXT_IS_OUT}" -eq 1 ]]; then
        OUT_DIR="${arg}"
        NEXT_IS_OUT=0
      fi
      ;;
  esac
done

node "${SCRIPT_DIR}/release.js" --out "${OUT_DIR}" --update-manifest "${OUT_DIR}/update_manifest.xml" "$@"

PUBLIC_DIR="${ROOT_DIR}/public/extension"
if [[ -d "${PUBLIC_DIR}" && "${PUBLIC_DIR}" != "${OUT_DIR}" ]]; then
  VERSION="$(node -e "const m=require('${ROOT_DIR}/manifest.json'); console.log(m.version)")"
  if [[ "${NO_ZIP}" -eq 0 && -f "${OUT_DIR}/chrome-extension_${VERSION}.zip" ]]; then
    cp "${OUT_DIR}/chrome-extension_${VERSION}.zip" "${PUBLIC_DIR}/"
  fi
  if [[ "${NO_UPDATE_MANIFEST}" -eq 0 && -f "${OUT_DIR}/update_manifest.xml" ]]; then
    cp "${OUT_DIR}/update_manifest.xml" "${PUBLIC_DIR}/"
  fi
fi
