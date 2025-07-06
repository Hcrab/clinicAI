// src/pages/api/check-password.js
export default function handler(req, res) {
    if (req.method === "POST") {
      const { password } = req.body;
      // 从环境变量中获取正确密码（仅在服务器端运行）
      const correctPassword = process.env.SECRET_PASSWORD;
      if (password === correctPassword) {
        res.status(200).json({ valid: true });
      } else {
        res.status(401).json({ valid: false });
      }
    } else {
      res.status(405).end(); // 只允许 POST 请求
    }
  }
  