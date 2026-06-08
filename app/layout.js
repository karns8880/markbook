import "./globals.css";

export const metadata = {
  title: "MarkBook",
  description: "MarkBook 是一个端到端加密的网页端账号密码记录工具。",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
