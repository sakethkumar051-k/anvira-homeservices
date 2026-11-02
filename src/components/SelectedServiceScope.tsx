import { Service } from "../lib/model";
import { Card, T } from "./ui";
export function SelectedServiceScope({
  service,
  packageId,
}: {
  service: Service;
  packageId: string;
}) {
  const pack = service.packages?.find((p) => p.id === packageId);
  const exclusions = [
    ...new Set([...(service.excludes || []), ...(pack?.excludes || [])]),
  ];
  return (
    <Card>
      <T bold>Your selected scope</T>
      {service.packageRequired && !pack ? (
        <T>Select a package to see exactly what is covered.</T>
      ) : (
        <>
          {!!service.priceUnit && <T>{service.priceUnit}</T>}
          {(pack?.includes?.length ? pack.includes : service.includes).map(
            (line, i) => (
              <T key={i}>{"✓ " + line}</T>
            ),
          )}
          {!!exclusions.length && (
            <>
              <T bold>Not included</T>
              {exclusions.map((line, i) => (
                <T key={i}>{"• " + line}</T>
              ))}
            </>
          )}
        </>
      )}
    </Card>
  );
}
