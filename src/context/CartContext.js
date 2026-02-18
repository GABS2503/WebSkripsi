// src/context/CartContext.js
"use client";
import { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);

  // Load cart from LocalStorage on start
  useEffect(() => {
    const savedCart = localStorage.getItem('msme_cart');
    if (savedCart) setCart(JSON.parse(savedCart));
  }, []);

  // Save cart to LocalStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('msme_cart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (item, options, customerInfo) => {
    const cartItem = {
      ...item,
      uniqueId: Date.now(), // Unique ID for this specific addition
      selectedOptions: options, // Variants, Delivery Choice, etc.
      customerInfo: customerInfo // Name, Address
    };
    setCart((prev) => [...prev, cartItem]);
    alert("Added to Cart!");
  };

  const removeFromCart = (uniqueId) => {
    setCart((prev) => prev.filter(item => item.uniqueId !== uniqueId));
  };

  const clearCart = () => setCart([]);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}