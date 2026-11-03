import { ref } from 'vue';

export const lang = ref('en');

const MR = {
  Home: 'होम', Khata: 'खाते', Loans: 'कर्ज', Approve: 'मंजूर करा', Me: 'मी', Gat: 'गट', 'Gat Tracker': 'गट ट्रॅकर',
  'To check': 'तपासायचे', 'Not paid': 'न भरलेले', Collected: 'जमा झाले', 'Cash received': 'रोख मिळाले', 'Everyone has paid': 'सर्वांनी भरले',
  'My account': 'माझे खाते', 'Gat tracker': 'गट ट्रॅकर', 'to check': 'तपासायचे', 'not paid': 'न भरलेले',
  'Good morning': 'सुप्रभात', 'Good afternoon': 'नमस्कार', 'Good evening': 'शुभ संध्या',
  'This month': 'या महिन्यात', 'Last date': 'शेवटची तारीख', 'days left': 'दिवस बाकी', 'Today is the last date': 'आज शेवटची तारीख',
  'Fine is running': 'दंड सुरू आहे', Paid: 'भरले', Due: 'बाकी', Sent: 'पाठवले', Late: 'उशीर',
  'Pay now': 'आता भरा', 'View receipt': 'पावती पहा', 'Waiting for approval': 'मंजुरीची वाट',
  Saving: 'बचत', Interest: 'व्याज', EMI: 'हप्ता (EMI)', Fine: 'दंड', Total: 'एकूण',
  'My savings': 'माझी बचत', 'My loan': 'माझे कर्ज', 'Our Gat': 'आपला गट',
  'Cash with group': 'गटाकडील रोख', 'Total savings': 'एकूण बचत', 'Loans with members': 'सभासदांकडील कर्ज', Earnings: 'नफा',
  'Paid this month': 'या महिन्यात भरले', 'Loan requests': 'कर्ज मागण्या', 'Vote': 'मत द्या', Yes: 'होय', No: 'नाही',
  'Your vote': 'तुमचे मत', 'Needs your approval': 'तुमच्या मंजुरीसाठी',
  'Pay Hapta': 'हप्ता भरा', 'Scan and pay to': 'स्कॅन करून पैसे पाठवा', 'Pay in UPI app': 'UPI ॲपमध्ये भरा',
  'Pay back more of your loan?': 'कर्ज जास्त फेडायचे आहे?', 'Close the loan': 'कर्ज पूर्ण फेडा',
  'Payment screenshot': 'पेमेंट स्क्रीनशॉट', 'Add screenshot': 'स्क्रीनशॉट जोडा', 'Change': 'बदला',
  'Send for approval': 'मंजुरीसाठी पाठवा', 'Sending…': 'पाठवत आहे…', 'Payment sent': 'पेमेंट पाठवले',
  'Approvers will check it and approve.': 'मंजूर करणारे तपासून मंजूर करतील.', 'Done': 'झाले',
  'Already sent for this month': 'या महिन्याचे आधीच पाठवले', 'Month': 'महिना', 'Paid on': 'भरल्याची तारीख',
  'My Khata': 'माझे खाते', Opening: 'सुरुवातीची बचत', 'No payments yet': 'अजून भरणा नाही',
  'My loans': 'माझी कर्जे', 'You can take up to': 'तुम्ही इतके कर्ज घेऊ शकता', 'No loan right now': 'सध्या कर्ज नाही',
  Repaid: 'फेडले', Left: 'बाकी', 'No requests to vote on': 'मत देण्यासाठी मागणी नाही',
  'All payments approved': 'सर्व पेमेंट मंजूर', 'Send back': 'परत पाठवा', 'Screenshot': 'स्क्रीनशॉट',
  Language: 'भाषा', 'Log out': 'बाहेर पडा', 'Open full desk': 'पूर्ण डेस्क उघडा', 'Group rules': 'गटाचे नियम',
  'Monthly saving': 'मासिक बचत', 'Due by': 'शेवटची तारीख', 'Late fine': 'उशिराचा दंड', 'Loan limit': 'कर्ज मर्यादा',
  'per day': 'प्रतिदिन', 'per month': 'दरमहा', 'of every month': 'दर महिन्याच्या',
  'Mobile or email': 'मोबाईल किंवा ईमेल', Password: 'पासवर्ड', 'Sign in': 'लॉगिन', 'Signing in…': 'लॉगिन होत आहे…',
  'Family savings, together': 'एकत्र बचत, एकत्र प्रगती', Show: 'दाखवा', Hide: 'लपवा', Retry: 'पुन्हा प्रयत्न',
  'Install AFBG on your phone': 'AFBG फोनवर इंस्टॉल करा', Install: 'इंस्टॉल', 'Open Monthly Sheet': 'मासिक शीट उघडा',
};

export function setLang(l) {
  lang.value = l === 'mr' ? 'mr' : 'en';
  try { localStorage.setItem('afbg-lang', lang.value); } catch (e) { /* private mode */ }
  document.documentElement.lang = lang.value;
}

export function t(s) {
  return lang.value === 'mr' ? MR[s] || s : s;
}
