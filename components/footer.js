import Link from "next/link";
import Logo from "./_logo";

export default function Footer() {
  return (
    <div className="footer">
      <div className="footer-top container">
        <div className="footer-logo">
          <Logo wide />
        </div>
        <div className="footer-links">
          <label>Products</label>
          <Link href="/farm">
            <a>Farms</a>
          </Link>
          <Link href="/lend">
            <a>Lending</a>
          </Link>
        </div>
        <div className="footer-links">
          <label>Support</label>
          <a
            href="https://docs.rodeofinance.xyz/other/faq"
            target="_blank"
            rel="noreferrer"
          >
            FAQ
          </a>
          <a
            href="https://docs.rodeofinance.xyz/the-protocol/how-to-participate/farmers-borrowers"
            target="_blank"
            rel="noreferrer"
          >
            Guides
          </a>
        </div>
        <div className="footer-links">
          <label>Contact</label>
          <a
            href="https://twitter.com/Rodeo_Finance"
            target="_blank"
            rel="noreferrer"
          >
            Contact Us
          </a>
          <a
            href="https://forms.gle/JvbJL5AhScscdRTt8"
            target="_blank"
            rel="noreferrer"
          >
            Partnerships
          </a>
        </div>
      </div>
      <div className="container text-faded mb-6">
        Rodeo Finance is a leveraged yield farming product, and using leveraged
        products involves certain risks. Please read{" "}
        <a
          href="https://docs.rodeofinance.xyz/"
          target="_blank"
          rel="noreferrer"
        >
          here
        </a>{" "}
        to understand these risks. As a user of our protocol, you are in
        agreement that you are aware of these risks, and that all liability
        resides with you. So please don’t invest your life savings, or risk
        assets you can’t afford to lose. Try to be as careful with your funds as
        we are with our code.
      </div>
      <div className="container text-center text-faded mb-6">
        © 2022 Rodeo Finance, All rights reserved.
      </div>
    </div>
  );
}
