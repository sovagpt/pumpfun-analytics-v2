export default function handler(req, res) {
  res.status(200).json({
    message: "🚀 API is working perfectly!",
    timestamp: new Date().toISOString(),
    method: req.method,
    status: "success"
  });
}