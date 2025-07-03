const jwt = require("jsonwebtoken");

app.use(
  cors({
    origin: "https://client-1-t9ar.onrender.com", // Frontend URL (Change for production)
    methods: "GET,POST,PUT,DELETE",
    allowedHeaders: "Content-Type, Authorization",
    credentials: true, // Needed for authentication
  })
);

app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader("Cross-Origin-Embedder-Policy", "credentialless"); // Alternative to 'require-corp'
  next();
});

const authMiddleware = (req, res, next) => {
  const token = req.header("Authorization");
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
};

module.exports = authMiddleware;
