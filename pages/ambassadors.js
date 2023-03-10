import Link from "next/link";
import Layout from "../components/layoutWebsite";

export default function Ambassadors() {
  return (
    <Layout>
      <div className="splash">
        <h1>Rodeo Ambassadors</h1>
        <Link href="#">
          <a className="button" target="_blank">
            Apply now!
          </a>
        </Link>
      </div>

      <div className="content-why" id="why">
        <h2>Why be an Ambassador?</h2>

        <div className="cards cards-ambassadors">
          <div className="card content-card">
            <h4>Perks</h4>
            <p>
              OG Status
              <br />
              Exclusive chat in Discord
            </p>
          </div>
          <div className="card content-card">
            <h4>Priority</h4>
            <p>
              Airdrop access
              <br />
              Exclusive events
            </p>
          </div>
          <div className="card content-card">
            <h4>Special Treatment</h4>
            <p>
              Access to core members
              <br />
              Merchandise
              <br />
              Bounties
            </p>
          </div>
        </div>
      </div>

      <div className="content-roadmap" id="roadmap">
        <h2>Example Tasks</h2>

        <div className="roadmap-lists roadmap-lists-ambassadors">
          <h3>Greenhorn Tasks</h3>
          <ul>
            <li className="completed">Follow Rodeo on Twitter</li>
            <li>Join the Telegram</li>
            <li>Join the Discord</li>
            <li>Follow the Discord</li>
            <li>Comment on Twitter posts</li>
          </ul>
          <h3>Wrangler Tasks</h3>
          <ul>
            <li className="completed">Create a meme</li>
            <li>Deposit 10 USDC in a lending pool</li>
            <li>Refer a friend</li>
            <li>Design a graphic for our next Twitter post</li>
            <li>Create a youtube video</li>
            <li>Create a presentation</li>
            <li>Create an infographic</li>
          </ul>
          <h3>Rancher Tasks</h3>
          <ul>
            <li className="completed">Write a blog post</li>
            <li>Create a data dashboard (Dune)</li>
            <li>Deposit 10000 USDC in a lending pool</li>
            <li>Help moderate Discord</li>
            <li>Help marketing, organize a partnership</li>
            <li>Contribute code (new strategies, bots)</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
}
