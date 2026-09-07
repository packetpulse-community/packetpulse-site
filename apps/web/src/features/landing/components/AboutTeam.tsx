import { Reveal } from "@/shared/components/Reveal";

// Same real community members listed on the reference site's About page,
// carried over as-is per explicit confirmation — not placeholder data.
// LinkedIn URLs are the same stable vanity profile links the reference site
// links to (its member photo URLs are LinkedIn CDN links with signed,
// long-expired timestamps, so those aren't reused — text-only cards instead).
const TEAM = [
  { name: "Sumit Kashyap", title: "Senior Network Engineer", employer: "Wipro", experience: "5 years exp.", linkedin: "https://www.linkedin.com/in/sumit-kashyap-443635250/" },
  { name: "Smruti Ranjan Naik", title: "Network Administrator", employer: "KIIT University", experience: "17 years exp.", linkedin: "https://www.linkedin.com/in/smruti-ranjan-naik-126a8675/" },
  { name: "Mahesh Shinde", title: "Sr. Network Analyst", employer: "Deutsche Bank India", experience: "8 years exp.", linkedin: "https://www.linkedin.com/in/mahesh-shinde-b08196a1" },
  { name: "Neelesh Lodhi", title: "Network Configuration Engineer", employer: "Wipro", experience: "3 years exp.", linkedin: "https://www.linkedin.com/in/neeleshhlodhi/" },
  { name: "Tushar Dahanwal", title: "Sr. System Engineer", employer: "Fortinet", experience: "10 years exp.", linkedin: "https://www.linkedin.com/in/tushar-dahanwal-3755b4b0/" },
  { name: "Nishikant Ganthade", title: "Ent. Network Engineer", employer: "Proactive Data Systems", experience: "3 years exp.", linkedin: "https://www.linkedin.com/in/nishikant24/" },
  { name: "Mohammed Sherif", title: "SDWAN Engineer", employer: "Capgemini", experience: "5 years exp.", linkedin: "https://www.linkedin.com/in/mohammed-sherif-m-b50a982a7/" },
  { name: "Mai Anwar", title: "Senior NOC Engineer", employer: "Telecom Egypt", experience: "5 years exp.", linkedin: "https://www.linkedin.com/in/mai-anwar-1b004540/" },
  { name: "Kartik Binzade", title: "Network Engineer Fresher", employer: null, experience: "0 years exp.", linkedin: "https://www.linkedin.com/in/kartik-binzade/" },
  { name: "Amar Rout", title: "Assistant Network Administrator Trainee (E1)", employer: "Eduquity", experience: "0.1 years exp.", linkedin: "https://www.linkedin.com/in/amarrout/" },
  { name: "Jignesh Ameta", title: "Field Support Engineer", employer: "CMS IT Services", experience: "5 years exp.", linkedin: "https://www.linkedin.com/in/jignesh-ameta-621772134" },
  { name: "Dhairya Nagpal", title: "Research Intern", employer: "CoE in CNDS, VJTI-Mumbai", experience: "1 years exp.", linkedin: "https://www.linkedin.com/in/dhairya-nagpal-26849a17a" },
  { name: "Manoj Reddy", title: "Network Engineer", employer: "AU Small Finance Bank", experience: "1 years exp.", linkedin: "https://www.linkedin.com/in/manoj-reddy-b770001b0" },
  { name: "Reshwanth Manupati", title: "Treasurer", employer: "RADIANCE", experience: "1 years exp.", linkedin: "https://www.linkedin.com/in/reshwanthmanupati" },
  { name: "Venkat Boggarapu", title: "Network Engineer", employer: "UltraViolet Cyber", experience: "1 years exp.", linkedin: "https://www.linkedin.com/in/venky980" },
  { name: "Yeswanthchowdary Jetty", title: "Network Engineer Fresher", employer: null, experience: "0.1 years exp.", linkedin: "https://www.linkedin.com/in/yeswanthchowdary-jetty-301b6718b" },
  { name: "Bhawna Das", title: "IT Engineer", employer: "Linde India", experience: "2 years exp.", linkedin: "https://www.linkedin.com/in/bhawna-das-82210a289" },
];

export function AboutTeam() {
  return (
    <section className="container py-20">
      <Reveal>
        <div className="mb-12 flex flex-col items-center gap-2 text-center">
          <h2 className="text-3xl font-semibold">Meet Our Team</h2>
          <p className="max-w-xl text-gray-300">
            Our dedicated team of professionals is passionate about creating the best platform for network engineers to
            connect, learn, and grow together.
          </p>
        </div>
      </Reveal>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {TEAM.map((member, index) => (
          <Reveal
            key={member.name}
            delayMs={(index % 8) * 60}
            className="flex flex-col gap-1 rounded-xl glass-panel glass-interactive p-4"
          >
            <a href={member.linkedin} target="_blank" rel="noreferrer" className="font-semibold hover:text-indigo-400 hover:underline">
              {member.name}
            </a>
            <p className="text-sm text-gray-300">{member.title}</p>
            {member.employer ? <p className="text-sm text-gray-300">{member.employer}</p> : null}
            <p className="text-xs text-indigo-400">{member.experience}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
