import { NextResponse } from 'next/server';
import Midtrans from 'midtrans-client';
import axios from 'axios';

// Ideally keep this in your .env.local file
const STRAPI_API_TOKEN = "cb1b2d1a1ab9410f6da4a4d7b31592920434f4fbab398b4075610d808efe42e524e128822d68556909f808ab6d8a1cbfcaef7feb0926dcf15bb96171ca0416fca46231090980dad26b964be5d152520e242ffe5c8157871298463dfe52cd80278acfc5d9e5ad53266ac7316402d1aa575d0a35e4f773e3079810a579ce801104"; 

export async function POST(request) {
  try {
    // 1. EXTRACT DATA
    const { id, price, name, quantity, type, details } = await request.json();

    // 2. SETUP SERVER KEY
    // Using your hardcoded key for now. 
    let serverKey = "Mid-server-3YJHL09y2ys1sTEuPuS0aLgm";

    // 3. INITIALIZE MIDTRANS
    let snap = new Midtrans.Snap({
      isProduction: false,
      serverKey: serverKey
    });

    const orderId = `ORDER-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    let parameter = {};

    // --- CRITICAL FIX: BRANCHING LOGIC ---

    if (type === 'cart_checkout') {
      // === OPTION A: CART CHECKOUT (Skip Database Check) ===
      console.log("Processing Cart Checkout...");

      // Prepare item details for Midtrans
      // If 'details' array exists, map it. Otherwise create a single summary item.
      const itemDetails = details ? details.map(item => ({
          id: item.id,
          price: parseInt(item.price),
          quantity: item.quantity,
          name: item.name.substring(0, 50)
      })) : [{
          id: id,
          price: parseInt(price),
          quantity: 1,
          name: name.substring(0, 50)
      }];

      parameter = {
        transaction_details: {
          order_id: orderId,
          gross_amount: parseInt(price), // Use the total calculated by frontend
        },
        item_details: itemDetails,
        enabled_payments: ["qris", "gopay", "shopeepay", "bank_transfer", "credit_card"],
        credit_card: { secure: true }
      };

    } else {
      // === OPTION B: SINGLE ITEM DIRECT BUY (Check Database) ===
      console.log("Processing Single Item Checkout...");
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const endpoint = type === 'service' ? 'services' : 'products';
      
      // Determine Filter
      let filterQuery = '';
      if (isNaN(Number(id))) {
        filterQuery = `filters[documentId][$eq]=${id}`;
      } else {
        filterQuery = `filters[id][$eq]=${id}`;
      }

      // Fetch from Strapi to verify price (Security)
      const strapiRes = await axios.get(`${apiUrl}/api/${endpoint}?${filterQuery}&populate=seller`, {
        headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` }
      });
      
      const itemData = strapiRes.data.data[0]; 

      if (!itemData) {
        return NextResponse.json({ error: `${type} not found in database` }, { status: 404 });
      }

      // Calculate Math safely
      const qty = quantity || 1;
      const unitPrice = Math.round(price / qty); 
      const safeGrossAmount = unitPrice * qty;

      parameter = {
        transaction_details: {
          order_id: orderId,
          gross_amount: safeGrossAmount
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
    }

    // 4. CREATE TRANSACTION
    const transaction = await snap.createTransaction(parameter);
    return NextResponse.json({ token: transaction.token });

  } catch (err) {
    console.error("Payment API Error:", err);
    const msg = err.ApiResponse?.error_messages?.[0] || err.message;
    return NextResponse.json({ error: `Payment Failed: ${msg}` }, { status: 500 });
  }
}
