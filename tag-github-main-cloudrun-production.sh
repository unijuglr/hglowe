#!/bin/bash

# Define the tag prefix
TAG_PREFIX="cloudrun-production-"

# Fetch the latest tags from the remote to ensure we're working with up-to-date information
git fetch --tags

# Get the latest tag with the specified prefix
latest_tag=$(git tag -l "${TAG_PREFIX}*" | sort -V | tail -n 1)

# Extract the number from the latest tag, or default to 0 if no tags are found
if [[ $latest_tag =~ ${TAG_PREFIX}([0-9]+)$ ]]; then
  latest_number=${BASH_REMATCH[1]}
  next_number=$((latest_number + 1))
else
  next_number=1
fi

# Construct the new tag
new_tag="${TAG_PREFIX}${next_number}"

# Create the new tag on the main branch
git tag -a "$new_tag" -m "Tagging main with $new_tag"

# Push the new tag to the remote repository
git push origin "$new_tag"

echo "Tagged main with $new_tag and pushed to remote."
