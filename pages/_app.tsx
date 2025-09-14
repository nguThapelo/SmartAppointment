import "../styles/tailwind.css";
import "../styles/globals.css";
import type { AppProps } from "next/app";

/**
 * Custom App component to include global styles.
 */
export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}