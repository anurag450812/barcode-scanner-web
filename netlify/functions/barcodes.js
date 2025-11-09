import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  const store = getStore("barcodes");
  const userId = context.ip || "default"; // Use IP as user ID
  
  if (req.method === "GET") {
    // Get barcodes for user
    const data = await store.get(userId);
    return new Response(data || JSON.stringify([]), {
      headers: { "Content-Type": "application/json" }
    });
  }
  
  if (req.method === "POST") {
    // Save barcodes for user
    const body = await req.text();
    await store.set(userId, body);
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  
  if (req.method === "DELETE") {
    // Clear barcodes for user
    await store.delete(userId);
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  
  return new Response("Method not allowed", { status: 405 });
};

export const config = {
  path: "/api/barcodes"
};
