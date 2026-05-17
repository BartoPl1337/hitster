# 🎵 Hitster Song Collector

Aplikacja do zbierania propozycji piosenek przed sesją gry [Hitster](https://www.hitster.game/). Każdy uczestnik może wyszukać swój ulubiony utwór na Spotify i dodać go do wspólnej listy — zanim zasiądziecie do gry.

## Jak to działa

1. Wchodzisz na stronę i wpisujesz swoje imię / nick
2. Wyszukujesz piosenkę po nazwie lub wykonawcy — wyniki pojawiają się na bieżąco z okładkami z Spotify
3. Wybierasz utwór i opcjonalnie dodajesz krótki komentarz (np. „klasyk z dzieciństwa")
4. Klikasz **Dodaj piosenkę** — trafia ona do wspólnej listy
5. Na stronie **Lista piosenek** wszyscy widzą co zostało dodane, mogą filtrować i skopiować całą listę do schowka

Aplikacja blokuje duplikaty — ta sama piosenka może pojawić się na liście tylko raz.

## Tech stack

| Warstwa | Technologia |
|---|---|
| Framework | Next.js 14 (App Router) |
| Język | TypeScript |
| UI | shadcn/ui + Tailwind CSS |
| Baza danych | Supabase (PostgreSQL) |
| Muzyka | Spotify Web API |
| Hosting | Vercel |
