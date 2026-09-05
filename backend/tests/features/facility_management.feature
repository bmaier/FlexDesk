# language: de
Funktionalität: Facility-Management
  Als Facility Management möchte ich neue Liegenschaften anlegen sowie bestehende
  Räume sperren können, ohne dass Betroffene im Ungewissen bleiben.

  Szenario: Neue Außenstelle mit vollständiger Hierarchie anlegen (Flow 8)
    Angenommen ich bin angemeldet als "Herr Brandt"
    Wenn ich die Liegenschaft "Außenstelle Leipzig" anlege
    Und ich darin ein Gebäude "Haus 1" anlege
    Und ich darin eine Etage "1. OG" anlege
    Und ich darin einen Raum "Büro Leipzig" vom Typ "desk_area" anlege
    Und ich darin einen Arbeitsplatz "L-01" anlege
    Dann kann der neue Arbeitsplatz "L-01" gebucht werden

  Szenario: Sperrung storniert bestehende Buchung und benachrichtigt Betroffene (Flow 7)
    Angenommen ich bin angemeldet als "Ali Yilmaz"
    Und ich einen Arbeitsplatz "N-04" für in 5 Tagen gebucht habe
    Wenn "Herr Brandt" diesen Arbeitsplatz mit Begründung "Wasserschaden" sperrt
    Dann ist meine Buchung storniert mit Begründung "Wasserschaden"
    Und ich erhalte eine Benachrichtigung vom Typ "foreign_cancel"

  Szenario: Ähnliche Labels werden beim Anlegen vorgeschlagen
    Angenommen ich bin angemeldet als "Herr Brandt"
    Wenn ich ein Label "Fenster-Platz" anlegen möchte
    Dann wird mir das ähnliche Label "Fensterplatz" vorgeschlagen
