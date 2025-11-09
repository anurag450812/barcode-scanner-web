import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  const store = getStore("barcodes");
  const globalKey = "global-barcode-list"; // Single key for all users
  
  if (req.method === "GET") {
    // Get global barcodes list
    const data = await store.get(globalKey);
    return new Response(data || JSON.stringify([]), {
      headers: { "Content-Type": "application/json" }
    });
  }
  
  if (req.method === "POST") {
    // Save global barcodes list
    const body = await req.text();
    await store.set(globalKey, body);
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  
  if (req.method === "DELETE") {
    // Clear global barcodes list
    await store.delete(globalKey);
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  
  return new Response("Method not allowed", { status: 405 });
};

export const config = {
  path: "/api/barcodes"
};
