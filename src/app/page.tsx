import type { Metadata } from "next";
import { BookingExperience } from "@/components/booking/booking-experience";
import { getCurrentUser } from "@/lib/auth/session";
import { getReservaPublicaSnapshot } from "@/lib/data/turnos";

export const metadata: Metadata = {
  title: "MALALA | Club de belleza",
  description:
    "Descubri servicios, sucursales, tienda online y reserva tu turno en MALALA.",
};

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
