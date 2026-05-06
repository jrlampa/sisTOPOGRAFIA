import React from "react";
import BtTopologyTransformerSubSection from "./BtTopologyTransformerSubSection";
import BtTopologyEdgeSubSection from "./BtTopologyEdgeSubSection";

const BtTransformerEdgeSection: React.FC = () => {
  const [isTransformerDropdownOpen, setIsTransformerDropdownOpen] =
    React.useState(false);

  return (
    <div className="space-y-4">
      <BtTopologyTransformerSubSection
        isTransformerDropdownOpen={isTransformerDropdownOpen}
        setIsTransformerDropdownOpen={setIsTransformerDropdownOpen}
      />

      <BtTopologyEdgeSubSection />
    </div>
  );
};

export default BtTransformerEdgeSection;
