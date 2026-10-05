import { Hammer } from "lucide-react";
import PageHeader from "@/components/page-header.tsx";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";

type Props = {
  title: string;
  description: string;
};

export default function ComingSoon({ title, description }: Props) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Hammer />
          </EmptyMedia>
          <EmptyTitle>Segera hadir</EmptyTitle>
          <EmptyDescription>
            Modul ini akan dibangun pada tahap berikutnya.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
}
