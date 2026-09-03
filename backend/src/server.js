const app = require('./app');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`[INFO] SecureDocChain backend listening on http://localhost:${PORT}`);
});