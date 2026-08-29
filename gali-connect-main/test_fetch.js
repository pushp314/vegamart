async function test() {
  try {
    const res = await fetch("http://localhost:8081/api/v1/products/d521dd8a-7dd4-44f8-877a-b8636769700e");
    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Text:", text.substring(0, 100));
  } catch (err) {
    console.error("Error:", err);
  }
}
test();
