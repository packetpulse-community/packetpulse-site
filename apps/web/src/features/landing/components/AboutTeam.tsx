// Same real community members listed on the reference site's About page,
// carried over as-is per explicit confirmation — not placeholder data.
const TEAM = [
  { name: "Sumit Kashyap", title: "Senior Network Engineer", employer: "Wipro", experience: "5 years exp." },
  { name: "Smruti Ranjan Naik", title: "Network Administrator", employer: "KIIT University", experience: "17 years exp." },
  { name: "Mahesh Shinde", title: "Sr. Network Analyst", employer: "Deutsche Bank India", experience: "8 years exp." },
  { name: "Neelesh Lodhi", title: "Network Configuration Engineer", employer: "Wipro", experience: "3 years exp." },
  { name: "Tushar Dahanwal", title: "Sr. System Engineer", employer: "Fortinet", experience: "10 years exp." },
  { name: "Nishikant Ganthade", title: "Ent. Network Engineer", employer: "Proactive Data Systems", experience: "3 years exp." },
  { name: "Mohammed Sherif", title: "SDWAN Engineer", employer: "Capgemini", experience: "5 years exp." },
  { name: "Mai Anwar", title: "Senior NOC Engineer", employer: "Telecom Egypt", experience: "5 years exp." },
  { name: "Kartik Binzade", title: "Network Engineer Fresher", employer: null, experience: "0 years exp." },
  { name: "Amar Rout", title: "Assistant Network Administrator Trainee (E1)", employer: "Eduquity", experience: "0.1 years exp." },
  { name: "Jignesh Ameta", title: "Field Support Engineer", employer: "CMS IT Services", experience: "5 years exp." },
  { name: "Dhairya Nagpal", title: "Research Intern", employer: "CoE in CNDS, VJTI-Mumbai", experience: "1 years exp." },
  { name: "Manoj Reddy", title: "Network Engineer", employer: "AU Small Finance Bank", experience: "1 years exp." },
  { name: "Reshwanth Manupati", title: "Treasurer", employer: "RADIANCE", experience: "1 years exp." },
  { name: "Venkat Boggarapu", title: "Network Engineer", employer: "UltraViolet Cyber", experience: "1 years exp." },
  { name: "Yeswanthchowdary Jetty", title: "Network Engineer Fresher", employer: null, experience: "0.1 years exp." },
  { name: "Bhawna Das", title: "IT Engineer", employer: "Linde India", experience: "2 years exp." },
];

export function AboutTeam() {
  return (
    <section className="container py-20">
      <div className="mb-12 flex flex-col items-center gap-2 text-center">
        <h2 className="text-3xl font-semibold">Meet Our Team</h2>
        <p className="max-w-xl text-gray-300">
          Our dedicated team of professionals is passionate about creating the best platform for network engineers to
          connect, learn, and grow together.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {TEAM.map((member) => (
          <div key={member.name} className="flex flex-col gap-1 rounded-xl bg-white/5 p-4 backdrop-blur-sm transition-colors hover:bg-white/10">
            <p className="font-semibold">{member.name}</p>
            <p className="text-sm text-gray-300">{member.title}</p>
            {member.employer ? <p className="text-sm text-gray-300">{member.employer}</p> : null}
            <p className="text-xs text-brand">{member.experience}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
