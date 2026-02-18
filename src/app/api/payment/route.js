import { NextResponse } from 'next/server';
import Midtrans from 'midtrans-client';
import axios from 'axios';

// NOTE: Ideally, move this to process.env.STRAPI_API_TOKEN in Vercel variables for security
const STRAPI_API_TOKEN = "cb1b2d1a1ab9410f6da4a4d7b31592920434f4fbab398b4075610d808efe42e524e128822d68556909f808ab6d8a1cbfcaef7feb0926dcf15bb96171ca0416fca46231090980dad26b964be5d152520e242ffe5c8157871298463dfe52cd80278acfc5d9e5ad53266ac7316402d1aa575d0a35e4f773e3079810a579ce801104"; 

export async function POST(request) {
  try {
    const { id, price, name, quantity, type } = await request.json();

    // 1. VALIDATE URL
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl || apiUrl.includes('localhost')) {
      console.warn("⚠️ WARNING: API URL seems to be localhost or missing:", apiUrl);
    }

    // 2. DETERMINE ENDPOINT & QUERY
    const endpoint = type === 'service' ? 'services' : 'products';
    let filterQuery = '';
    
    // Support both Strapi v4 (ID) and v5 (DocumentID)
    if (isNaN(Number(id))) {
      filterQuery = `filters[documentId][$eq]=${id}`;
    } else {
      filterQuery = `filters[id][$eq]=${id}`;
    }

    // 3. FETCH ITEM FROM STRAPI
    // We use the cloud URL here
    const strapiRes = await axios.get(`${apiUrl}/api/${endpoint}?${filterQuery}&populate=seller`, {
      headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` }
    });
    
    const itemData = strapiRes.data.data[0]; 

    if (!itemData) {
      return NextResponse.json({ error: `${type} not found (404)` }, { status: 404 });
    }

    // 4. EXTRACT SELLER DATA (Safe Extract)
    const attributes = itemData.attributes || itemData;
    const sellerData = attributes.seller?.data?.attributes || attributes.seller;

    if (!sellerData) {
      return NextResponse.json({ error: "Seller info missing on this item" }, { status: 404 });
    }

    // 5. GET SELLER'S MIDTRANS KEY
    // Support both naming conventions (snake_case vs camelCase)
    let serverKey = "Mid-server-3YJHL09y2ys1sTEuPuS0aLgm";

    if (!serverKey) {
      return NextResponse.json({ error: `Seller '${sellerData.username}' has not configured a Midtrans Key.` }, { status: 400 });
    }

    // 6. INITIALIZE MIDTRANS
    let snap = new Midtrans.Snap({
      isProduction: false, // Sandbox Mode
      serverKey: serverKey
    });

    const orderId = `ORDER-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // --- MATH FIX: PREVENT MIDTRANS TOTAL MISMATCH ---
    const qty = quantity || 1;
    // We recalculate unit price to be safe
    const unitPrice = Math.round(price / qty); 
    // We recalculate the gross amount to match EXACTLY (Unit * Qty)
    const safeGrossAmount = unitPrice * qty;

    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: safeGrossAmount // Must match item_details math exactly
      },
      item_details: [{
        id: id,
        price: unitPrice,
        quantity: qty,
        name: (name || "Item").substring(0, 50)
      }],
      enabled_payments: ["qris", "gopay", "shopeepay", "bank_transfer", "credit_card"],
      credit_card: { secure: true }
    };

    // 7. CREATE TRANSACTION
    const transaction = await snap.createTransaction(parameter);
    
    return NextResponse.json({ token: transaction.token });

  } catch (err) {
    console.error("Payment API Error:", err);
    // Extract meaningful error message from Midtrans or Axios
    const msg = err.ApiResponse?.error_messages?.[0] || err.response?.data?.error?.message || err.message;
    return NextResponse.json({ error: `Payment Failed: ${msg}` }, { status: 500 });
  }
}
