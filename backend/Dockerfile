FROM node:20-alpine

# Install LibreOffice for DOCX→PDF conversion
RUN apk add --no-cache libreoffice openjdk17-jre

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Create storage directories
RUN mkdir -p /storage/templates /storage/contracts /storage/previews /storage/logos /storage/tmp
RUN mkdir -p /data

ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/data/database.sqlite
ENV STORAGE_PATH=/storage

EXPOSE 3001

CMD ["node", "-r", "tsx/cjs", "src/index.ts"]
