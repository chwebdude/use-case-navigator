import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Button, Card } from "../components/ui";
import { useUser } from "../hooks/useUser";

export default function AdminPowerPage() {
  const { grantPower, isPowerUser } = useUser();

  useEffect(() => {
    grantPower();
  }, [grantPower]);

  return (
    <div className="mx-auto max-w-xl py-16">
      <Card className="text-center py-12">
        <ShieldCheck className="mx-auto h-12 w-12 text-green-600" />
        <h1 className="mt-4 text-2xl font-bold text-primary-900">
          Admin power enabled
        </h1>
        <p className="mt-2 text-gray-600">
          {isPowerUser
            ? "You can now verify factsheets and add review comments."
            : "Your admin mode is being enabled."}
        </p>
        <Link to="/factsheets" className="mt-6 inline-block">
          <Button>Go to Factsheets</Button>
        </Link>
      </Card>
    </div>
  );
}
