import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { fmt } from "@/domain/money";
import { Figure } from "./Figure";

export const entries: CatalogEntry[] = [
  {
    id: "figure",
    name: "Figure",
    group: "Data",
    tasks: ["show a number", "show money", "show the pool", "show a code", "count up a hero figure", "sign a ledger line"],
    variants: ["sm", "md", "lg", "unit", "countUp", "secondary", "signed auto", "sign +", "sign -", "mono", "string value", "as dd"],
    render: () => (
      <>
        <Specimen label="sm">
          <Figure size="sm" value={184050} format={fmt} />
        </Specimen>
        <Specimen label="md">
          <Figure size="md" value={400000} format={fmt} />
        </Specimen>
        <Specimen label="lg">
          <Figure size="lg" value={12} />
        </Specimen>
        <Specimen label="unit">
          <Figure size="md" value={400000} format={fmt} unit="a month" />
        </Specimen>
        <Specimen label="countUp">
          <Figure size="lg" value={127400} format={fmt} unit="this month" countUp data-testid="catalog-count-up" />
        </Specimen>
        <Specimen label="secondary">
          <Figure size="sm" value={-20000} format={fmt} tone="secondary" />
        </Specimen>
        <Specimen label="signed auto">
          <Figure size="sm" value={20000} format={fmt} signed />
          <Figure size="sm" value={-20000} format={fmt} signed />
          <Figure size="sm" value={0} format={fmt} signed />
        </Specimen>
        <Specimen label="sign +">
          <Figure size="sm" value={20000} format={fmt} signed sign="+" />
        </Specimen>
        <Specimen label="sign -">
          <Figure size="sm" value={20000} format={fmt} signed sign="-" />
        </Specimen>
        <Specimen label="mono">
          <Figure size="md" family="mono" value="DEKALB-7Q2M" />
        </Specimen>
        <Specimen label="string value">
          <Figure size="md" value="-" />
        </Specimen>
        <Specimen label="as dd">
          <dl>
            <dt className="label-small secondary">Pool</dt>
            <Figure as="dd" size="md" value={92000} format={fmt} />
          </dl>
        </Specimen>
      </>
    ),
  },
];
