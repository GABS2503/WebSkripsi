import './globals.css';
import AccessibilityToolbar from '../components/AccessibilityToolbar'; // <--- Import here

export const metadata = {
  title: 'MSME Market',
  description: 'Support local businesses',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <AccessibilityToolbar /> {/* <--- Add this line here */}
      </body>
    </html>
  );
}