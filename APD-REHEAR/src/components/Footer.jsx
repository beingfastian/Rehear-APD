import logo from '../assets/APD_LOGO-.png';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container footer-wrap">
        <a href="#" aria-label="Rehear home">
          <img src={logo} alt="Rehear" className="footer-logo" />
        </a>
        <p>
          &copy; {year} Rehear replay what you hear, clarify, understand. All
          rights reserved.
        </p>
        <a href="#top" className="footer-link">
          Back to top
        </a>
      </div>
    </footer>
  );
}
