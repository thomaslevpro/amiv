export const events = [
  {
    id: 1,
    name: 'Sophie Lefebvre',
    eventName: 'Soirée surprise',
    age: '25 ans',
    date: 'Sam. 10 mai · 19h00',
    location: 'Rooftop · 45 rue de la Roquette',
    emoji: '🎉',
    guests: 18,
    tags: [{ label: 'Surprise', type: 'pink' }, { label: 'RSVP requis', type: 'blue' }],
    organizer: 'Lucas Dupont',
    daysLeft: 20,
    description: 'On organise une soirée surprise pour les 25 ans de Sophie ! Venez nombreux, surtout ne lui dites rien 🤫',
  },
  {
    id: 2,
    name: 'Thomas Renard',
    eventName: "Brunch d'anniversaire",
    age: '30 ans',
    date: 'Dim. 18 mai · 11h00',
    location: 'Café Oberkampf, Paris',
    emoji: '🥂',
    guests: 12,
    tags: [{ label: 'Brunch', type: 'blue' }, { label: 'Organisé par moi', type: 'green' }],
    organizer: 'Toi',
    daysLeft: 28,
    description: 'Mon brunch d\'anniversaire pour les 30 ans ! Un moment convivial entre amis pour bien démarrer la journée.',
  },
  {
    id: 3,
    name: 'Emma Bernard',
    eventName: 'Karaoké birthday',
    age: '27 ans',
    date: 'Ven. 6 juin · 21h00',
    location: 'Starlight Karaoké, Bastille',
    emoji: '🎤',
    guests: 24,
    tags: [{ label: 'Soirée', type: 'pink' }, { label: 'RSVP requis', type: 'blue' }],
    organizer: 'Chloé Martin',
    daysLeft: 47,
    description: 'Karaoké pour les 27 ans d\'Emma ! Une nuit de chant et de fous rires garantis 🎶',
  },
]

export const birthdays = [
  { id: 1, name: 'Marie Dubois', age: '28 ans', countdown: 'Dans 3 jours', urgent: true, emoji: '👩' },
  { id: 2, name: 'Lucas Martin', age: '31 ans', countdown: 'Dans 12 jours', urgent: false, emoji: '👨' },
  { id: 3, name: 'Camille Petit', age: '26 ans', countdown: 'Dans 3 sem.', urgent: false, emoji: '👩' },
  { id: 4, name: 'Antoine Duval', age: '29 ans', countdown: 'Dans 1 mois', urgent: false, emoji: '👨' },
]

export const conversations = [
  {
    id: 0,
    name: 'Anniversaire Sophie',
    lastMessage: 'Lucas: On se retrouve à 18h30 !',
    time: '14:32',
    unread: 3,
    emoji: '🎉',
    messages: [
      { me: false, text: 'Salut tout le monde ! 🎉' },
      { me: false, text: 'On se retrouve à 18h30 samedi ?' },
      { me: true, text: 'Parfait pour moi !' },
      { me: false, text: "J'apporte les bouteilles 🍾" },
      { me: true, text: "Moi j'apporte le gâteau" },
      { me: false, text: 'On se retrouve à 18h30 !' },
    ],
  },
  {
    id: 1,
    name: 'Brunch Thomas 🥂',
    lastMessage: 'Toi: Super, je confirme !',
    time: '11:15',
    unread: 0,
    emoji: '🥂',
    messages: [
      { me: true, text: 'Bonjour tout le monde !' },
      { me: false, text: 'Hâte d\'être là 😊' },
      { me: true, text: 'Super, je confirme !' },
    ],
  },
  {
    id: 2,
    name: 'Karaoké Emma 🎤',
    lastMessage: 'Chloé: Vous connaissez l\'adresse ?',
    time: 'Hier',
    unread: 1,
    emoji: '🎤',
    messages: [
      { me: false, text: 'Super soirée en vue !' },
      { me: false, text: 'Vous connaissez l\'adresse ?' },
    ],
  },
  {
    id: 3,
    name: 'Marie Dubois',
    lastMessage: 'À bientôt 🎁',
    time: 'Lun.',
    unread: 0,
    emoji: '👩',
    messages: [
      { me: true, text: 'Bon anniversaire Marie !' },
      { me: false, text: 'Merci beaucoup !! 😊' },
      { me: false, text: 'À bientôt 🎁' },
    ],
  },
]

export const calendarEvents = [
  { day: 10, event: events[0] },
  { day: 18, event: events[1] },
  { day: 24, event: events[2] },
]

export const currentUser = {
  name: 'Thomas R.',
  email: 'thomas@amiv.app',
  since: 'Membre depuis avril 2025',
  emoji: '👤',
}
