import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { Booking, dateLabel, money, statusLabel } from "../lib/model";
import { dispatchSummary } from "../lib/dispatch";
import { Card, T, Badge, Row, c } from "./ui";

export default function StaffOrderCards({ bookings }: { bookings: Booking[] }) {
  return (
    <View style={{ gap: 12 }}>
      {bookings.map((booking) => {
        const dispatch = dispatchSummary(booking, "staff");
        return (
          <Pressable
            key={booking.id}
            accessibilityRole="button"
            accessibilityLabel={"Open order " + booking.id.slice(0, 8)}
            onPress={() => router.push(("/booking/" + booking.id) as never)}
          >
            <Card style={{ backgroundColor: c.ivory }}>
              <Row
                style={{ justifyContent: "space-between", flexWrap: "wrap" }}
              >
                <T bold>{booking.customerName}</T>
                <Badge
                  label={dispatch?.label || statusLabel(booking.status)}
                  tone={
                    dispatch?.attention
                      ? "amber"
                      : booking.status === "cancelled"
                        ? "red"
                        : "green"
                  }
                />
              </Row>
              <T bold size={17}>
                {booking.serviceName}
              </T>
              <T size={12}>{dateLabel(booking.slot)}</T>
              <T size={12} color={c.muted}>
                PIN {booking.address.pin} · #
                {booking.id.slice(0, 8).toUpperCase()}
              </T>
              <Row
                style={{ justifyContent: "space-between", flexWrap: "wrap" }}
              >
                <T bold>{money(booking.total)}</T>
                <T size={12}>
                  {booking.payment === "paid"
                    ? "Payment received"
                    : statusLabel(booking.payment)}
                </T>
              </Row>
              {!!dispatch?.detail && (
                <T size={12} color={c.muted}>
                  {dispatch.detail}
                </T>
              )}
              <T bold size={12} color={c.green}>
                Open order & next actions →
              </T>
            </Card>
          </Pressable>
        );
      })}
    </View>
  );
}
