import type { FAQPage, SoftwareApplication, WithContext } from "schema-dts";
import { Experts } from "@/components/home/experts";
import { EarlyAccess } from "@/components/home/early-access";
import { Faq } from "@/components/home/faq";
import { Footer } from "@/components/home/footer";
import { Header } from "@/components/home/header";
import { Hero } from "@/components/home/hero";
import { HowItWorks } from "@/components/home/how-it-works";
import { NeverTheSame } from "@/components/home/never-the-same";
import { Pricing } from "@/components/home/pricing";
import { Principles } from "@/components/home/principles";
import { Stakes } from "@/components/home/stakes";
import { JsonLd } from "@/components/json-ld";
import { scanCase } from "@/lib/domain/case-scan";
import { amaF1 } from "@/lib/domain/fixtures";
import { demoSessions, heroLines } from "@/lib/demo";
import { faq } from "@/lib/faq";
import { plans } from "@/lib/pricing";
import { site } from "@/lib/site";

const app: WithContext<SoftwareApplication> = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: site.name,
  applicationCategory: "EducationalApplication",
  operatingSystem: "Web, Android, iOS",
  description: site.description,
  url: site.url,
  inLanguage: site.lang,
  publisher: { "@id": `${site.url}/#organization` },
  offers: plans.map((p) => ({
    "@type": "Offer",
    name: p.name,
    price: p.priceGhs,
    priceCurrency: "GHS",
    availability: "https://schema.org/PreOrder",
  })),
};

const faqLd: WithContext<FAQPage> = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faq.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function Home() {
  return (
    <>
      <Header />
      <main id="main">
        <Hero lines={heroLines()} />
        <Stakes />
        <HowItWorks flags={scanCase(amaF1)} />
        <NeverTheSame sessions={demoSessions()} />
        <Principles />
        <Experts />
        <Pricing />
        <Faq />
        <EarlyAccess />
      </main>
      <Footer />
      <JsonLd data={[app, faqLd]} />
    </>
  );
}
