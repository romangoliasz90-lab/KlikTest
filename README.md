# KlikTest – wdrożenie krok po kroku

Strona (index.html) + dwie funkcje serwerowe (api/) + baza Supabase (schema.sql). Hosting: Vercel.

## 1. Supabase (konta i baza)
1. Załóż projekt na supabase.com.
2. SQL Editor → wklej całość `schema.sql` → Run.
3. Authentication → Providers → Email: włącz „Confirm email".
4. Authentication → URL Configuration: Site URL = adres Twojej strony (po kroku 3).
5. Settings → API: skopiuj Project URL, `anon` key i `service_role` key (tego ostatniego NIGDY nie wklejaj do index.html).
6. Authentication → SMTP: podłącz własną pocztę (np. Resend). Wbudowana wysyła tylko kilka maili na godzinę.

## 2. Klucz API modelu
Konsola Anthropic → API keys → utwórz klucz. Ustaw limit miesięcznych wydatków.

## 3. Vercel
1. Wgraj folder do repozytorium GitHub i zaimportuj je w Vercel (framework: Other).
2. W index.html podmień `SB_URL` i `SB_ANON` (klucz anon jest publiczny z założenia).
3. Environment Variables:
   - SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY
   - ANTHROPIC_API_KEY
   - SITE_URL (adres strony)
   - opcjonalnie: RESEND_API_KEY i MAIL_FROM (wysyłka „przypomnij login"), MODEL (domyślnie claude-haiku-5-5), DAILY_LIMIT (domyślnie 30 rund generowania na użytkownika dziennie)
4. Deploy.

## 4. Zanim udostępnisz publicznie (obowiązkowe przy dzieciach)
- Uzupełnij `regulamin.html` i `prywatnosc.html` (RODO, zgoda rodzica poniżej 16 lat) z pomocą prawnika.
- Sprawdź nazwę „KlikTest" w rejestrach znaków towarowych.

## Co jeszcze nie jest zrobione
Katalog działów z podstawy programowej (dział wpisuje uczeń), synchronizacja motywu między urządzeniami, panel do przeglądania zgłoszonych pytań (zgłoszenia są w tabeli `reports`, pytanie po 3 zgłoszeniach wypada z obiegu).
