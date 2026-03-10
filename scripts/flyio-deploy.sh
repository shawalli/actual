#!/usr/bin/env zsh

# Read Fly.io app name from fly.toml (gitignored)
if [ -f fly.toml ]; then  
  FLY_APP=$(grep '^app' fly.toml | cut -d'"' -f2)
  if [ -z "$FLY_APP" ]; then
    echo "Error: Could not find app name in fly.toml"
    exit 1
  fi
else
  echo "Error: fly.toml file not found."
  exit 1
fi

fly deploy
