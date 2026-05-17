import './globals.css';
import Sidebar from '@/app/components/Sidebar';

export const metadata = {
  title: 'NLN Automation Dashboard',
  description: 'Command center for NLN Serverless Automation System',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="flex h-screen overflow-hidden antialiased bg-background text-foreground">
        <Sidebar />

        {/* Main Content */}
        {/* pt-14 offsets the fixed mobile top bar; md:pt-0 removes it on desktop */}
        <main className="flex-1 overflow-y-auto p-4 pt-[72px] md:pt-0 md:p-8 md:pl-4">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}