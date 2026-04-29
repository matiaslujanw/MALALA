import { BookingExperience } from "@/components/booking/booking-experience";
import { getReservaPublicaSnapshot } from "@/lib/data/turnos";
import { getCurrentUser } from "@/lib/auth/session";

export default async function HomePage() {
  const [snapshot, user] = await Promise.all([
    getReservaPublicaSnapshot(),
    getCurrentUser(),
  ]);

  return (
    <BookingExperience
      snapshot={snapshot}
      loggedInLabel={user ? user.nombre : undefined}
    />
  );
}
