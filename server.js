const app = require('./index');

const PORT = process.env.PORT || 5001;

app.listen(PORT, '0.0.0.0' ,() => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
