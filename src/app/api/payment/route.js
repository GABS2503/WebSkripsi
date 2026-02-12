import { NextResponse } from 'next/server';
import Midtrans from 'midtrans-client';
import axios from 'axios';

// KEEP YOUR TOKEN HERE
const STRAPI_API_TOKEN = "4b7dd9b288d2086c32422661f2e10cb570d6871612c5605337e65342acf083754379ce82829276a860e75fb335ba264c223e56414e7b185cbf8d2b77b42f80a12b1d3c533c28c3e851c3ce624a2b7178314971f296aca3aba018a2dda99228f4d19de557f5722d72d6571dbaa683afa574c0bc95e095ba9f20147afba0508d71"; 

export async function POST(request) {
  try {
    const { id, price, name, quantity, type } = await request.json();

    // 1. DETERMINE ENDPOINT
    const endpoint = type === 'service' ? 'services' : 'products';
    
    // 2. SMART SEARCH
    let filterQuery = '';
    if (isNaN(Number(id))) {
      filterQuery = `filters[documentId][$eq]=${id}`;
    } else {
      filterQuery = `filters[id][$eq]=${id}`;
    }

    const strapiRes = await axios.get(`http://localhost:1337/api/${endpoint}?${filterQuery}&populate=seller`, {
      headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` }
    });
    
    const itemData = strapiRes.data.data[0]; 

    if (!itemData) {
      return NextResponse.json({ error: `${type} not found (404)` }, { status: 404 });
    }

    // 3. EXTRACT SELLER DATA
    const sellerData = itemData.attributes?.seller?.data?.attributes || itemData.attributes?.seller || itemData.seller;

    if (!sellerData) {
      return NextResponse.json({ error: "Seller info missing" }, { status: 404 });
    }

    // 4. GET KEYS (SANDBOX)
    let serverKey = sellerData.midtrans_server_key || sellerData.midtransServerKey;

    if (!serverKey) {
      return NextResponse.json({ error: `Seller ${sellerData.username} has no Midtrans Key.` }, { status: 400 });
    }

    // 5. INITIALIZE MIDTRANS (FORCE SANDBOX)
    let snap = new Midtrans.Snap({
      isProduction: false, // <--- FORCED TO FALSE FOR SANDBOX
      serverKey: serverKey
    });

    const orderId = `ORDER-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: parseInt(price)
      },
      item_details: [{
        id: id,
        price: parseInt(price / (quantity || 1)),
        quantity: quantity || 1,
        name: name.substring(0, 50)
      }],
      enabled_payments: ["qris", "gopay", "shopeepay", "bank_transfer", "credit_card"],
      credit_card: { secure: true }
    };

    const transaction = await snap.createTransaction(parameter);
    return NextResponse.json({ token: transaction.token });

  } catch (err) {
    console.error("Payment API Error:", err.message);
    const msg = err.ApiResponse?.error_messages?.[0] || err.message;
    return NextResponse.json({ error: `Midtrans Failed: ${msg}` }, { status: 500 });
  }
}