# 使用官方 Node.js 映像檔作為基礎
FROM node:18-alpine

# 設置工作目錄
WORKDIR /app

# 複製 package.json 和 package-lock.json
COPY package*.json ./

# 安裝依賴
RUN npm install

# 複製所有文件
COPY . .

# 暴露端口
EXPOSE 3000

# 運行開發伺服器
CMD ["npm", "run", "dev"]