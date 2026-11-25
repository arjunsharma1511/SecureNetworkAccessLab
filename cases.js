"use strict";

const chapters = [
  {
    title: "VPN tunnel", short: "VPN", icon: "01",
    intro: "A virtual private network (VPN) uses encryption to make data unreadable to outsiders as it travels between a remote device and a gateway. That protected path is the tunnel. The gateway checks the user and device. Resource policy controls what they can open.",
    cue: "Watch where the animated tunnel ends. At the gateway, the request still needs permission to reach the work app."
  },
  {
    title: "Network zones", short: "Zones", icon: "02",
    intro: "Segmentation puts staff devices, guests, servers and management systems in separate zones. A policy gate allows specific paths for business needs. Fewer open paths can limit how far a compromise spreads.",
    cue: "Start with the requester’s zone, then find the requested resource in the route policy."
  },
  {
    title: "Zero Trust checks", short: "Zero Trust", icon: "03",
    intro: "Zero Trust uses identity, device health, the requested resource and context to decide access. A policy can ask for another check as conditions change. Least privilege means granting only the access someone needs for their work. How an organisation applies these ideas depends on its needs and risks.",
    cue: "Look at individual checks. Being inside the building or already connected can leave other checks unresolved."
  },
  {
    title: "Network hardening", short: "Hardening", icon: "04",
    intro: "Hardening reduces unnecessary exposure and keeps systems securely configured. The baseline is the approved set of settings. Compare it with what you observe, recommend a narrow change, and check that essential services still work. A rollback plan explains how to restore the prior settings if the change causes trouble.",
    cue: "Test the security requirement and the business requirement. Get approval, plan a rollback, and record the result before treating a simulated recommendation as a real change."
  },
  {
    title: "Final remote shift", short: "Final shift", icon: "05",
    intro: "Harborline is opening remote access for a support shift. Use the supplied policy and configuration evidence to make decisions that protect the network and keep staff working.",
    cue: "For each case, say what you know, why the decision follows, and how you would verify it."
  }
];

const resources = {
  app: { label: "Work app", zone: "Server zone", mark: "APP" },
  files: { label: "File server", zone: "Server zone", mark: "FILE" },
  admin: { label: "Admin console", zone: "Management zone", mark: "ADMIN" },
  web: { label: "Public web", zone: "Internet", mark: "WEB" }
};

const policies = {
  support: { label: "Remote support", person: "Maya · Support", device: "SUP-LT-07", allows: ["app"] },
  remoteIT: { label: "Remote IT admin", person: "Owen · IT admin", device: "IT-LT-02", allows: ["app", "admin"] },
  staff: { label: "Staff network", person: "Priya · Staff", device: "STAFF-LT-12", allows: ["app", "files"] },
  guest: { label: "Guest Wi-Fi", person: "Guest session G-04", device: "GUEST-04", allows: ["web"] },
  management: { label: "IT management zone", person: "Owen · IT admin", device: "MGMT-WS-02", allows: ["admin"] }
};

const reason = (question, answer, alternatives, position, explanation, hint) => {
  const options = [...alternatives];
  options.splice(position, 0, answer);
  return { question, options, answer: position, explanation, hint };
};

const access = (title, story, request, review) => ({ kind: "access", title, story, ...request, review });
const change = (title, story, baseline, observed, options, tests, review) => ({
  kind: "change", title, story, baseline, observed, options, tests, review
});

const exercises = [
  [
    access("A shift starts at the café", "Maya is a support agent. She signs in from a managed laptop and needs the work app for her shift.", { source: "support", resource: "app", vpn: "new" }, reason(
      "What does the VPN protect here?", "The connection from Maya’s laptop to the VPN gateway", ["Every file on Maya’s laptop", "Every internal service after the gateway by default"], 1,
      "The tunnel protects data in transit on this path. Maya also has to pass the checks for the work app.", "Find the two ends of the highlighted tunnel.")),
    access("Password accepted, second check missing", "Maya entered her password, but the required second-factor check was not completed.", { source: "support", resource: "app", vpn: "new", identity: false }, reason(
      "Which control should be satisfied before starting the tunnel?", "Authentication, including the required second factor", ["File permissions", "The destination application’s log retention"], 0,
      "The gateway needs the required identity checks before it opens remote access.", "Look at the first check recorded in the event log.")),
    access("A borrowed laptop", "Maya completes both sign-in checks from a borrowed personal laptop. That laptop is not approved for Harborline remote access.", { source: "support", resource: "app", vpn: "new", device: false, deviceName: "PERSONAL-01" }, reason(
      "Why is sign-in only part of the decision?", "The device must meet the organisation’s remote access policy too", ["The password must be longer on café Wi-Fi", "A successful sign-in grants access to whatever device is in use"], 2,
      "Authentication identifies the user. The separate device check determines whether that device can be used here.", "Compare the identity and device entries.")),
    access("One extra door", "Maya’s VPN is already connected. She follows a bookmark to the admin console, which her support role does not require.", { source: "support", resource: "admin", vpn: "active" }, reason(
      "What should Maya's existing VPN session allow here?", "Only the resources approved for her role", ["The admin console because she has a tunnel", "Every destination on the server network"], 0,
      "The tunnel stays active while the policy denies this particular resource request.", "Check the resource policy separately from tunnel status.")),
    access("Read the remote access log", "An analyst asks you to explain the result of a normal remote support session. Replay the supplied request to generate an event log.", { source: "support", resource: "app", vpn: "new" }, reason(
      "Which details make a useful access record?", "Time, requester, device, target and decision", ["The requester’s password and second-factor code", "Only the fact that Wi-Fi was in use"], 1,
      "The event trail supports accountability without collecting secrets.", "Compare the visible log fields with the three choices. Credentials are not log evidence you need here."))
  ],
  [
    access("A visitor needs the internet", "A guest connects to lobby Wi-Fi and visits the public web.", { source: "guest", resource: "web" }, reason(
      "Why keep a guest internet route?", "Visitors can use the internet while staff resources remain separated", ["Guest devices should reach the management zone", "Every guest needs the same access as a staff laptop"], 2,
      "The guest zone serves its approved purpose without opening staff resources.", "Which one resource does the guest policy list?")),
    access("The same visitor follows a work link", "From the guest Wi-Fi, the visitor tries to open the staff file server.", { source: "guest", resource: "files" }, reason(
      "What limits the reach of the guest device?", "The rule that separates the guest zone from internal file services", ["The colour of the file server", "Whether the visitor can browse a public site"], 0,
      "The gate blocks the cross-zone request while the approved guest route remains available.", "Compare this destination with the previous request.")),
    access("Staff need shared files", "A managed staff laptop on the office network requests the file server for normal work.", { source: "staff", resource: "files" }, reason(
      "What does this allowed path show?", "Segmentation can preserve specific connections staff need", ["Every connection between zones must be blocked", "The file server is now public"], 1,
      "Segmentation controls which paths cross boundaries. The staff-to-files route is listed for everyday work.", "Read the allowed destination list for Staff network.")),
    access("An office laptop reaches for management", "A managed staff laptop requests the admin console. Its owner has a normal staff role.", { source: "staff", resource: "admin" }, reason(
      "What can blocking this path help protect?", "Admin interfaces if an ordinary laptop is compromised", ["The laptop’s battery", "Every file on the internet"], 2,
      "Keeping ordinary devices away from administration reduces the potential reach of a compromise.", "Look at the destination’s zone and compare it with the staff policy.")),
    access("An approved maintenance route", "An IT administrator uses an approved workstation in the management zone to open the admin console.", { source: "management", resource: "admin" }, reason(
      "Why keep the management route?", "Authorised administrators need a controlled way to maintain devices", ["All office devices should use it", "Management traffic never needs logging"], 0,
      "A narrowly permitted management path supports necessary work and stays subject to the other access checks.", "The same resource can have a different result when the source changes."))
  ],
  [
    access("Same network, different person", "Someone at an approved staff workstation opens the file server without a verified staff identity.", { source: "staff", resource: "files", identity: false }, reason(
      "Which signal is missing?", "Verified identity", ["The file server’s zone", "A second network cable"], 1,
      "The staff route exists, but physical location does not verify who is using the workstation.", "The device and resource checks cannot replace the identity check.")),
    access("The device falls out of compliance", "Halfway through her shift, Maya's laptop loses its required protection. An immediate device review applies to new work-app requests.", { source: "support", resource: "app", vpn: "active", device: false }, reason(
      "What does reassessment change here?", "New access is denied when device status changes", ["The original sign-in now proves device health", "The app can ignore device policy until tomorrow"], 2,
      "The active tunnel remains visible in this scenario, but the next resource request is denied when device status changes.", "Find the new result for the device check, then compare it with tunnel status.")),
    access("Admin task after hours", "An authorised IT administrator requests the admin console. The device passes policy, but this is outside the normal maintenance window.", { source: "remoteIT", resource: "admin", vpn: "active", context: "verify" }, reason(
      "What should happen while the extra check is pending?", "Pause access and ask for the additional approved verification", ["Grant access because there is already a tunnel", "Treat the account as definitely compromised"], 1,
      "Policy asks for a new check in the unusual context before opening the admin console.", "The access is pending, rather than already approved or permanently denied.")),
    access("The extra check is now complete", "The same after-hours request comes back. The administrator completed the extra verification on an approved device.", { source: "remoteIT", resource: "admin", vpn: "active", context: "verified" }, reason(
      "Why can this request now reach its target?", "The permitted resource and verified context both satisfy policy", ["After-hours restrictions have been removed for everyone", "Any extra identity check grants every resource"], 0,
      "The additional check satisfies this request’s context requirement. Role and device checks still apply.", "Compare this replay with the pending after-hours check.")),
    access("A trusted device asks for the wrong resource", "An approved remote support laptop requests the file server. The sign-in and device checks pass, and the time is routine.", { source: "support", resource: "files", vpn: "active" }, reason(
      "Which principle is working at the resource gate?", "Least privilege", ["Automatic internal trust", "Unrestricted access after sign-in"], 2,
      "Remote support is permitted to use the work app. The file server is outside that role’s needs.", "Find the approved resources for the role."))
  ],
  [
    change("An old service is still running", "The approved inventory says the legacy demo service has no users. The work app handles all staff requests.",
      "Legacy demo service off. Work app available.", "Legacy demo service on. Work app available.",
      ["Keep both services running", "Turn off the unused demo service only", "Turn off both services"],
      [{ label: "Unused demo service off", pass: [false, true, true] }, { label: "Work app still available", pass: [true, true, false] }],
      reason("What makes the narrow change appropriate?", "The inventory shows the demo is unused while the work app remains essential", ["Both services are old enough to remove", "All staff can stop working for the shift"], 1,
        "Removing a confirmed unused service reduces exposure while preserving the required app.", "One test is about reducing exposure, and one is about keeping work possible.")),
    change("An admin page is too widely reachable", "Only administrators in the management zone need the console. Staff still need the work app.",
      "Admin console reachable from management only.", "Admin console reachable from all office zones.",
      ["Restrict console access to the management zone", "Shut down the console everywhere", "Leave access open and add a warning banner"],
      [{ label: "Staff-to-console access blocked", pass: [true, true, false] }, { label: "Management-to-console access preserved", pass: [true, false, true] }, { label: "Work app remains reachable", pass: [true, true, true] }],
      reason("Which two paths verify the restriction?", "A staff device is blocked and an approved management device succeeds", ["Two staff devices are both blocked", "Only the work app is tested"], 0,
        "Both a forbidden and a required path matter when validating a restriction.", "Test the change from both sides of the access boundary.")),
    change("A device is overdue for maintenance", "A gateway update is approved for a planned maintenance window. Staff are using the gateway now.",
      "Approved update applied in the window with a rollback plan.", "Update missing. Current shift active.",
      ["Restart and patch the gateway immediately", "Postpone the update without a new date", "Schedule the approved update with a backup, a health check and a rollback plan"],
      [{ label: "Approved update scheduled", pass: [false, false, true] }, { label: "Active shift protected", pass: [false, true, true] }, { label: "Recovery plan recorded", pass: [false, false, true] }],
      reason("What should you verify after the patch window?", "The installed version and an authorised test connection", ["Only that the clock changed", "Only that the admin console looks the same"], 2,
        "The version confirms the update and a test connection confirms the service works.", "Look for one configuration check and one functional check.")),
    change("A temporary rule passed its expiry", "A vendor had temporary access to the file server. The ticket shows that the work ended yesterday, and staff still need the share.",
      "Expired vendor access removed. Staff access retained.", "Vendor exception still active.",
      ["Keep the rule for possible future jobs", "Remove the expired vendor exception through change review", "Block all users from the file server"],
      [{ label: "Expired access removed", pass: [false, true, true] }, { label: "Staff file access preserved", pass: [true, true, false] }],
      reason("Which record explains why access can be removed?", "The vendor ticket’s scope and expiry", ["A screenshot of the file server desktop", "A list of staff usernames"], 0,
        "The approved ticket identifies the temporary access and its expiration.", "Find the evidence that the vendor’s work ended.")),
    change("The baseline and observed settings differ", "A gateway replacement restored an old profile. The approved profile keeps remote access logs and forwards them to a central collection service.",
      "Remote access logging and central forwarding enabled.", "Local logs only. Central forwarding disabled.",
      ["Disable local logs too", "Enable forwarding and verify a test event lands at the collector", "Record the mismatch as approved without checking with the owner"],
      [{ label: "Central test event received", pass: [false, true, false] }, { label: "Local logs retained", pass: [false, true, true] }],
      reason("What should go into the change record?", "The approved setting, observed difference, authorised change and verification result", ["Only the device model", "The users’ sign-in secrets"], 2,
        "The change record helps an analyst check future drift and understand what was verified.", "Use the test result as well as the before-and-after settings."))
  ],
  [
    access("Support must stay productive", "Maya starts the new shift from café Wi-Fi on her approved laptop. She needs the work app only.", { source: "support", resource: "app", vpn: "new" }, reason(
      "Which summary describes the full decision?", "Identity and device pass, the VPN protects the remote path, and policy allows the work app", ["The café Wi-Fi authorised Maya", "The VPN replaces identity and resource checks"], 1,
      "The successful request combines encryption, identity, device and least-privilege access.", "Read the event log from tunnel setup through resource decision.")),
    access("A public area gets the wrong link", "A visitor has internet access through guest Wi-Fi and is sent a link to the admin console.", { source: "guest", resource: "admin" }, reason(
      "What would you write in the incident note?", "Guest-to-admin request denied by policy. Successful access is not shown.", ["The admin console definitely changed settings", "The guest was authenticated as an administrator"], 0,
      "Record the observed decision and avoid claiming anything beyond the event.", "The replay shows one request and its recorded outcome.")),
    access("The support laptop is flagged mid-shift", "Monitoring flags the remote laptop as out of policy during an active VPN session. The user tries the work app again.", { source: "support", resource: "app", vpn: "active", device: false }, reason(
      "Which next action supports investigation and recovery?", "Record the denial, follow the help desk process, and recheck device health before restoring access", ["Bypass the device check so the user can work", "Delete previous access records"], 2,
      "A device review and retained logs support recovery and accountability.", "Protect evidence and keep the health requirement in place.")),
    change("The shift lead submits a change plan", "Remote support needs the app. IT needs the management console. An unused demo service is still reachable.",
      "Support app available. Admin path restricted. Demo off.", "Support app available. Admin console too widely reachable. Demo on.",
      ["Disable the work app and the admin console", "Protect the admin route and retire the unused demo service after approval", "Disable the demo service and leave the console reachable to all staff"],
      [{ label: "Support app still works", pass: [false, true, true] }, { label: "Admin console restricted and usable by IT", pass: [false, true, false] }, { label: "Unused demo service off", pass: [false, true, true] }],
      reason("What makes this a complete change recommendation?", "It reduces both exposures and verifies the routes staff and IT still need", ["It shuts down every available path", "It covers only the easiest change"], 1,
        "Both exposure and availability have evidence before the recommendation is accepted.", "Look for all three checks to pass together.")),
    change("Hand over a verified configuration", "The shift lead needs a record that another technician can verify. The recommended changes have been approved for a scheduled window.",
      "Record includes approval, settings, access test results and rollback.", "Ticket contains only the words 'tighten network'.",
      ["Record approval, exact setting changes, pass/fail evidence and the rollback plan", "Record 'all systems are safe' after one successful test", "Close the ticket with no evidence"],
      [{ label: "Approval and setting changes recorded", pass: [true, false, false] }, { label: "Required and forbidden paths tested", pass: [true, false, false] }, { label: "Rollback plan documented", pass: [true, false, false] }],
      reason("Which evidence best supports the final hand-off?", "Recorded results for both required and blocked paths, with a reference to the approved change", ["A guarantee that nothing can ever go wrong", "Only the name of the person on shift"], 0,
        "Another technician can check the approved settings, reproduce the validation and follow the recovery plan.", "Choose the note someone else could verify."))
  ]
];
