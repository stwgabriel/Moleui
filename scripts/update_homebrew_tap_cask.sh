#!/usr/bin/env bash

set -euo pipefail

usage() {
    cat << 'EOF'
Usage:
  update_homebrew_tap_cask.sh \
    --cask /path/to/Casks/moleui.rb \
    --tag V1.35.0 \
    --version 1.35.0 \
    --arm-sha <sha256> \
    --amd-sha <sha256>
EOF
}

cask_path=""
tag=""
version=""
arm_sha=""
amd_sha=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --cask)
            cask_path="${2:-}"
            shift 2
            ;;
        --tag)
            tag="${2:-}"
            shift 2
            ;;
        --version)
            version="${2:-}"
            shift 2
            ;;
        --arm-sha)
            arm_sha="${2:-}"
            shift 2
            ;;
        --amd-sha)
            amd_sha="${2:-}"
            shift 2
            ;;
        -h | --help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown argument: $1" >&2
            usage >&2
            exit 1
            ;;
    esac
done

if [[ -z "$cask_path" || -z "$tag" || -z "$version" || -z "$arm_sha" || -z "$amd_sha" ]]; then
    usage >&2
    exit 1
fi

# Create the Casks directory if it doesn't exist
cask_dir="$(dirname "$cask_path")"
if [[ ! -d "$cask_dir" ]]; then
    mkdir -p "$cask_dir"
fi

# Generate the cask file
cat > "$cask_path" << CASK
cask "moleui-desktop" do
  version "${version}"

  on_arm do
    url "https://github.com/stwgabriel/moleui/releases/download/${tag}/Moleui.Desktop-#{version}-arm64.zip"
    sha256 "${arm_sha}"
  end

  on_intel do
    url "https://github.com/stwgabriel/moleui/releases/download/${tag}/Moleui.Desktop-#{version}-x64.zip"
    sha256 "${amd_sha}"
  end

  name "Moleui Desktop"
  desc "Deep clean and optimize your Mac - Desktop GUI"
  homepage "https://github.com/stwgabriel/moleui"

  app "Moleui Desktop.app"

  zap trash: [
    "~/Library/Application Support/moleui-desktop",
    "~/Library/Caches/moleui-desktop",
    "~/Library/Preferences/dev.tw93.moleui.desktop.plist",
    "~/Library/Saved Application State/dev.tw93.moleui.desktop.savedState",
  ]
end
CASK

echo "Updated cask: $cask_path (version $version)"
