export function referralShareUrl(code: string): string {
  return `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://getinsound.com'}?ref=${code}`
}

export function twitterShareUrl(code: string): string {
  const text = `I just joined @getinsound — a new music platform that actually pays artists. Check it out: ${referralShareUrl(code)}`
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
}

export function whatsappShareUrl(code: string): string {
  const text = `Check out Insound — a new music platform that actually pays artists. Join here: ${referralShareUrl(code)}`
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

export function emailShareUrl(code: string): string {
  const subject = 'Join me on Insound'
  const body = `Hey! I just joined Insound — a new music platform where independent artists keep more of what they earn. Check it out: ${referralShareUrl(code)}`
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
