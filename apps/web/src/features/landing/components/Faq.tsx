import Link from "next/link";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/shared/ui/primitives/Accordion";
import { Reveal } from "@/shared/components/Reveal";

const FAQ_ITEMS = [
  {
    question: "What is PacketPulse Community?",
    answer:
      "PacketPulse is a professional community platform for network engineers — covering forums, curated resources, session recordings, and quizzes with certificates, all in one place.",
  },
  {
    question: "How do I join the community?",
    answer:
      "Click \"Join the Community\" and complete the registration form. Once your email is verified and an admin approves your account, you'll have full access.",
  },
  {
    question: "What resources are available for members?",
    answer:
      "Members get access to technical documentation, troubleshooting guides, best practices, video recordings from past sessions, and quizzes that issue certificates on completion.",
  },
  {
    question: "Are there any live discussions or Q&A?",
    answer:
      "Yes — the forums support threaded discussions and replies, so you can ask questions and get answers directly from other members and moderators.",
  },
  {
    question: "How can I contribute to the community?",
    answer:
      "You can start discussions in the forums, publish resources, upload session recordings, or author quizzes for others to take — all from your account once approved.",
  },
];

export function Faq() {
  return (
    <section className="container py-20">
      <Reveal>
        <div className="mb-12 flex flex-col items-center gap-2 text-center">
          <h2 className="text-3xl font-semibold">Frequently Asked Questions</h2>
          <p className="max-w-xl text-gray-300">Have questions about PacketPulse? Find answers to commonly asked questions below.</p>
        </div>

        <Accordion type="single" collapsible className="mx-auto max-w-2xl divide-y divide-white/10">
          {FAQ_ITEMS.map((item, index) => (
            <AccordionItem key={item.question} value={`item-${index}`}>
              <AccordionTrigger>{item.question}</AccordionTrigger>
              <AccordionContent>{item.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <p className="mt-10 text-center text-sm text-gray-300">
          Still have questions?{" "}
          <Link href="/contact" className="font-medium text-brand hover:underline">
            Contact Support
          </Link>
        </p>
      </Reveal>
    </section>
  );
}
