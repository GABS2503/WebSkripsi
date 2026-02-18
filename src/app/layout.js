import './globals.css';
import AccessibilityToolbar from '../components/AccessibilityToolbar'; 
import { CartProvider } from '@/context/CartContext'; // Import CartProvider

export const metadata = {
  title: 'MSME Market',
  description: 'Support local businesses',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <CartProvider>
          {children}
          <AccessibilityToolbar />
        </CartProvider>
      </body>
    </html>
  );
}
