import { AccessStateView } from "@/components/access-state-view";

export function NotFoundView({
  title = "Page not found",
  body = "The page you requested could not be found.",
  next = "Check the link and try again, or return to the previous page.",
}: {
  title?: string;
  body?: string;
  next?: string;
} = {}) {
  return <AccessStateView code={404} title={title} body={body} next={next} />;
}
