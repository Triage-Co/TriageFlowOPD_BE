#!/bin/bash

echo "Cấp quyền cho prisma"
chmod +x ./node_modules/.bin/prisma || true

echo "Generate prisma"
npx prisma generate

echo "Khởi động ứng dụng"
node dist/main.js