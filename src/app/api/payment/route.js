import { NextResponse } from 'next/server';
import Midtrans from 'midtrans-client';
import axios from 'axios';

const STRAPI_API_TOKEN = "cb1b2d1a1ab9410f6da4a4d7b31592920434f4fbab398b4075610d808efe42e524e128822d68556909f808ab6d8a1cbfcaef7feb0926dcf15bb96171ca0416fca46231090980dad26b964be5d152520e242ffe5c8157871298463dfe52cd80278acfc5d9e5ad53266ac7316402d1aa575d0a35e4f773e3079810a579ce801104"; 

export async function POST(request) {
  try {
    const body = await request.json();
    const { id, price, name, quantity, type, details } = body;

    // --- DEBUG LOGS ---
    console.log("Payment Request Received!");
    console.log("Type:", type);
    console.log("ID:", id);

    let serverKey = "Mid-server-3YJHL09y2ys1sTEuPuS0aLgm";

    let snap = new Midtrans.Snap({
      isProduction: false,
      serverKey: serverKey
    });

    const orderId = `ORDER-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    let parameter = {};

    // === CART CHECKOUT LOGIC ===
    if (type === 'cart_checkout') {
      console.log("✅ PROCESSING AS CART CHECKOUT (Skipping DB Check)");

      const itemDetails = details ? details.map(item => ({
          id: String(item.id).substring(0, 50),
          price: parseInt(item.price),
          quantity: parseInt(item.quantity),
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
          gross_amount: parseInt(price),
        },
        item_details: itemDetails,
        enabled_payments: ["qris", "gopay", "shopeepay", "bank_transfer", "credit_card"],
        credit_card: { secure: true }
      };

      // --- SAVE ORDER TO STRAPI ---
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const sellerId = details[0]?.seller?.id || details[0]?.seller?.documentId;

      if (sellerId) {
          try {
            await axios.post(`${apiUrl}/api/orders`, {
                data: {
                    order_id: orderId,
                    total_price: parseInt(price),
                    order_status: 'pending', // <--- CHANGED FROM 'status' TO 'order_status'
                    buyer_name: details[0].customerInfo?.name || 'Guest',
                    delivery_location: JSON.stringify({
                        type: details[0].selectedOptions?.deliveryType,
                        lat: details[0].customerInfo?.lat,
                        lng: details[0].customerInfo?.lng,
                        address_note: details[0].customerInfo?.address
                    }),
                    items: JSON.stringify(details.map(i => ({ name: i.name, qty: i.quantity, price: i.price }))),
                    seller: sellerId 
                }
            }, {
                headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` }
            });
            console.log("✅ Order saved to Strapi successfully");
          } catch (dbError) {
            console.error("❌ Failed to save order to Strapi:", dbError.response?.data || dbError.message);
          }
      }

    } 
    // === SINGLE ITEM LOGIC ===
    else {
      console.log("⚠️ PROCESSING AS SINGLE ITEM (Checking DB)");
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const endpoint = type === 'service' ? 'services' : 'products';
      
      let filterQuery = '';
      if (isNaN(Number(id))) {
        filterQuery = `filters[documentId][$eq]=${id}`;
      } else {
        filterQuery = `filters[id][$eq]=${id}`;
      }

      const strapiRes = await axios.get(`${apiUrl}/api/${endpoint}?${filterQuery}&populate=seller`, {
        headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` }
      });
      
      const itemData = strapiRes.data.data[0]; 

      if (!itemData) {
        console.error("❌ ITEM NOT FOUND IN STRAPI");
        return NextResponse.json({ error: `${type} not found (404)` }, { status: 404 });
      }

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

    const transaction = await snap.createTransaction(parameter);
    return NextResponse.json({ token: transaction.token });

  } catch (err) {
    console.error("🔥 Payment API Error:", err);
    const msg = err.ApiResponse?.error_messages?.[0] || err.message;
    return NextResponse.json({ error: `Payment Failed: ${msg}` }, { status: 500 });
  }
}
