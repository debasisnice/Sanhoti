#!/bin/bash
# Quick script to add the public key to EC2
# Run this after SSH'ing into your EC2 instance

echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJ4fSUqRvYcIH+RojyAkf0zgwcDwbBJ2qL2I56S0VkML github-actions-deploy" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
echo "✅ Public key added to EC2"


