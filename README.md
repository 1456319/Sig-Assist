# Sig-Assist

Long-Term Care Facilities and Assisted Living Facilities depend on closed-door pharmacies.. These pharmacies are dedicated only to the needs needs of these facilities 24-hours a day, and so must meet these needs totally and successfully meet them every single day. Typically, the process is thus:

A facility nurse will type a medical order disctated, verbally, by a practitioner into their Electronic Medical Administration Records system. Although this sounds simple, it takes a great deal of competence to transcribe the order in a way that ensures it is both 100% correct, and syntactically entered in a manner which meets all regulatory standards and so can be transferred to the pharmacy for dispensing. If processed correctly, the EMAR entry is then converted to an HL7 message and transmitted to the pharmacy. Once reaching the pharmacy, it is accepted by the the pharmacy's Iguana (or similar) HL7 message receiver and minimally preprocessed before then being pushed to the appropriate state's pharmacy, where a human operator must parse the nurse's entry via some interface software like FrameworkLTC or some similar interface where a human operator interprets the HL7 nearly-raw message to sensical, pharmaceutically elegant instruction-set which is verified by a skilled pharmacist, then administered to residents by nurses.

These two enteties, pharmacies and LTHCs, endevor to work together, but are ultimately completely at the mercy of one-another. When error are made, complexe and expensive subpoenas of medical records must be issued and can take months to determine fault, if any fault is determined at all. Pharmacies must dispense medications based on what LTHC, ALF facilities, nurses, PAs, NPs, MD, etc free-type into their MAR - so long as it is sensible. However, sensibile does not always mean correct. Patients being treated for hypotension are sometimes administered anti-hypertensive drugs for years before such a subtle error is caught. SPS and Potassium are both kept onsite at nearly every facility as insidious and apparently insignificant drug interactions of low doses ultimately hospitalize someone who was simply to sensitive to the error in the medications administered to them, exposing patients to harm and pharmacies and care facilities alike to liability.  

Without facility-to-pharmacy and back pipeline with as many safeguards as possible, a fortified pipeline conductive to ACCURATE order entry AND administration, patients at facilities are put at risk. 



*****

The residents at these facilities are people. Loved ones. Your parents, parents of your friends, people enduring some of the worst hardships imaginable.

A closed-door, LTHC-oriented pharmacy has a duty to ensure that they never have to explain that an already at-risk and suffering resident at any facility was harmed as a result of poor transcription by a human operator. In the same vein, these human operators are not unfeeling machines. They endevor ruthlessly to do their jobs accurately and safely.

However, the less glamorous side of this pipeline is cost. Human agents need to do their job with 100% accuracy. It would be reasonable to believe that to neglect patient safety in the effort of moving quickly to keep up with a constant influx of orders and prescriptions would be the action of a cold, uncaring operator, detached from the suffering and vulnerable people on the receiving end of their haste.

However paradoxical it may seem, the opposite is also true. Seasoned operators understand that when they only have enough operators and pharmacists working that day to process 2,000 orders total, suddenly receiving an influx of 5,000 orders immediately creates an untenable situation.  If these operators process their absolute limit of what is possible to do safely, 3,000 medications go unprocessed. If they push themselves so hard as to succeed in completing the 5,000 orders, the rate of careless mistakes that would otherwise not be made rises drastically.

The concept of avoiding such a desperate situation demands a solution. Often, these are even less glamorous, as these solutions are often expensive.

Calling in technicians AND pharmacists to cover the increased demand introduces monetary barriers as overtime expenses soar. The human cost of tasking a technician to work a 100-hour week just as burdensome. Money and people, no matter how willing or skilled they might be, will make mistakes when ordered to move fast. They miss time with their children, and trade that for more and more exhaustion. As excellent as planning ahead as these pharmacies are at the highest levels of management, a pharmacy better tooled to handle a sudden influx of work that must be done demands a more predictable solution, one that offers employees, nurses, patients, and management all peace-of-mind without a significant increase in expenditure of moral nor money.

people could be your elderly friends and parents. , designed to display those HL7 messages as complete prescriptions/orders to be parsed by a human, then transcribed to shorthands "SIG Codes".
Sig processing will be handled in a priority-based order of importance - SIGs that affect fields such as "quantity per day" automatically based on the SIG code itself will be considered high-priority when compared to much less important diagnosis-based sig-codes, which affect no clinically significant fields automatically.

Considered important:
Daily use frequency (QD? BID?)
Quantity be dose (1T? 2T? 2T650?)
Pre-populated sig blending: (DISSOLVE 17GM [(SEE INSIDE CAP)]/[1PACKET] IN [8]/[4-8] OZ OF [WATER]/[WATER OR JUICE]/[FLUID OF CHOICE] AND GIVE [PO]/[GT]/[PEGT] [Q24H]/[QD]/[Q24H AT NIGHT] [[PRN]] [[(H FLS]])




[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/sb1-anlnsuwh)

## SIG engine foundation

`src/lib/sigEngine.ts` uses three separate stages: `parseSigOrder` extracts
structured facts, validation records warnings/blocking issues, and `renderSig`
builds the concise SIG. Add medication-specific defaults as data/templates
around this engine; do not add final-output substitutions to the UI parser.

Run the regression tests with `npm test`.

Drug-context-aware conversions [20.3ML (650MG)]? [10ML (200MG)]?
Pharmaceutical Elegance [DATE IN SIG? NURSE TYPED 1ML WHEN SHE OBVIOUSLY MEANT 1 TABLET?]
CRITICAL REVIEW FLAGGING - EDGE CASES OR CASES WHERE THE TECH DISAGREES WITH THE SUGGESTED SIG MUST BE ANONYMIZED, STORED, AND ADDRESSED.

Less important:
F[x] [FDEM? FHEM? FPAIN?]
