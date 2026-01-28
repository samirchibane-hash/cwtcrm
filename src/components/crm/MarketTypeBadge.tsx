interface MarketTypeBadgeProps {
  marketType: string;
}

const MarketTypeBadge = ({ marketType }: MarketTypeBadgeProps) => {
  if (!marketType) return null;
  
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">
      {marketType}
    </span>
  );
};

export default MarketTypeBadge;
